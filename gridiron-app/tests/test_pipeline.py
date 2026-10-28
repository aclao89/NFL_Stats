import copy
from datetime import date,timedelta
import unittest
from gridiron.refresh import select_games,normalize_players
from gridiron.training import build_features,team_code

def game(i=0,home='IND',away='WAS',hs='24',aws='20'):
    d=(date(2025,9,1)+timedelta(days=7*i)).isoformat()
    return {'game_id':f'2025_{i+1:02d}_{away}_{home}','season':'2025','game_type':'REG','week':str(i+1),'gameday':d,'home_team':home,'away_team':away,'home_score':hs,'away_score':aws,'location':'Home','home_rest':'7','away_rest':'7'}

class PipelineTests(unittest.TestCase):
    def test_future_and_unfinished_scores_do_not_enter_training(self):
        rows=[game(),game(1,hs='',aws=''),game(2)]
        done,next_games=select_games(rows,2021,'2025-09-10')
        self.assertEqual(len(done),1)
        self.assertEqual(done[0]['gameday'],'2025-09-01')
        self.assertTrue(all(g['date']>='2025-09-10' for g in next_games))

    def test_duplicate_games_and_invalid_scores_fail(self):
        self.assertRaises(ValueError,select_games,[game(),game()],2021,'2025-12-31')
        self.assertRaises(ValueError,select_games,[game(hs='NaN')],2021,'2025-12-31')

    def test_features_never_use_their_own_or_a_later_outcome(self):
        games=[game(i,hs=str(20+i),aws=str(15+i%4)) for i in range(12)]
        before,_=build_features(games)
        changed=copy.deepcopy(games);changed[8]['home_score']='70'
        after,_=build_features(changed)
        b={r['game_id']:r['x'] for r in before};a={r['game_id']:r['x'] for r in after}
        for g in games[:9]:
            if g['game_id'] in b:self.assertEqual(b[g['game_id']],a[g['game_id']])
        self.assertNotEqual(b[games[9]['game_id']],a[games[9]['game_id']])

    def test_player_zeros_and_negative_yards_are_preserved(self):
        g=game();r={'player_id':'00-test','player_display_name':'Test Player','position':'RB','season':'2025','week':'1','season_type':'REG','game_id':g['game_id'],'team':'IND',
            'passing_yards':'0','rushing_yards':'-3','receiving_yards':'0','receptions':'0','completions':'0','passing_tds':'0','rushing_tds':'0','receiving_tds':'0','def_tds':'2','fumble_recovery_tds':'2'}
        rows=normalize_players([r],{g['game_id']:g},2025)
        self.assertEqual(rows[0][3][6],-3)
        self.assertEqual(rows[0][3][-1],0) # Explicit rushing + receiving scope.
        self.assertEqual(len(normalize_players([r],{},2025)),0)
        self.assertRaises(ValueError,normalize_players,[r,r],{g['game_id']:g},2025)
        r['passing_yards']='';self.assertRaises(ValueError,normalize_players,[r],{g['game_id']:g},2025)

    def test_franchise_aliases_are_normalized(self):
        self.assertEqual(team_code('OAK'),'LV');self.assertEqual(team_code('LA'),'LAR')
        self.assertEqual(team_code('SD'),'LAC');self.assertEqual(team_code('JAC'),'JAX')

if __name__=='__main__':unittest.main()
