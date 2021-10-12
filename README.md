# NFL_Stats

![data_screen](https://github.com/aclao89/NFL_Stats/blob/main/Images/data_analysis_readme.jpg)

Every data analysis starts with an idea and/or problem. The following step usually involves the crucial element: data. Data can be found everywhere and can be stored in various formats and data types.

For those of us who love diving into data, there are lots of resources to attain this part of the process. Whether it’s through Kaggle, Data World, or search engines powered Google, data is easily available. However, sometimes the datasets pulled from the mentioned resources might not have all the data pertinent for a thorough analysis.

This issue of getting incomplete or insufficient data brought me to explore web scraping to create a dataset. I have worked on an [basketball analytics project](https://github.com/aclao89/NBA_All_Stars). The project was an analysis of NBA All-Star selections from 2000 to 2016 to examine the commonalities and differences over time. As I loaded and cleaned the dataset pulled from Kaggle, I realized the dataset did not have all the stats pertinent to my analysis. To avoid the same issue, I went directly to a reputable resource and did further research to find ways to pull data directly from a website.

For this project, I went to [Pro Football Reference](https://www.pro-football-reference.com/); this site is an encyclopedia for all NFL stats. My research resulted in discovering a great Python library called [BeautifulSoup](https://www.crummy.com/software/BeautifulSoup/bs4/doc/). It used for web scraping purposes to pull the data out of HTML and XML files. It creates a parse tree from page source code that can be used to extract data in a hierarchical and more readable manner.

The purpose of this project was to pull quarterback stats from the 2020-2021 NFL season from [Pro Football Reference](https://www.pro-football-reference.com/) and utilized radar charts to assess efficiency.

A [radar chart](https://www.data-to-viz.com/caveat/spider.html) is a two-dimensional chart type designed to plot one or more series of values over multiple quantitative variables. Each variable has its own axis, all axes are joined in the center of the figure.


## Questions asked:

1. What stats should we take into consideration to determine quarterback efficiency?
2. Four NFL teams drafted quarterbacks from the 2020 NFL Draft Class: did teams take the correct steps in replacing their current respective quarterback? i.e. quarterbacks don't get replaced often since they are the main focus of a team's offense; switching quarterbacks too often can lead to inconsistent play schemes and ruin team chemistry.
3. Aaron Rodgers was the 2020 NFL Most Valuable Player (MVP). How did his stats match up to other quarterback candidates in the MVP race?
4. Does a high quarterback efficiency equate to higher chance of winning league MVP?

________________________________________________________________________________________

# Import required Python Libraries

We will use two modules to open the webpage and scrape the data: urllib.request and BeautifulSoup, respectively.

In addition, we will also use pandas and numpy libraries for data manipulation as well as matplotlib for the radar charts.

![import sc](https://github.com/aclao89/NFL_Stats/blob/main/Images/import_lib.PNG)

# Scrape the data

The dataset imported is the [NFL passing data](https://www.pro-football-reference.com/years/2020/passing.htm) from the 2020 - 2021 season.

![scrape data](https://github.com/aclao89/NFL_Stats/blob/main/Images/scrape_data.PNG)

The two functions via BeautifulSoup used to scrape the data were [findAll()](https://www.crummy.com/software/BeautifulSoup/bs4/doc/#find-all) and [getText()](https://www.crummy.com/software/BeautifulSoup/bs4/doc/#get-text), which return values based on the HTML of the page.


Luckily, this dataset has been nicely formatted in a table, so we can find the table rows and columns to extract directly from the cells. In HTML, tr and td refer to table row and columns, respectively.

![html_page](https://github.com/aclao89/NFL_Stats/blob/main/Images/table_row.PNG)

![row_col_head](https://github.com/aclao89/NFL_Stats/blob/main/Images/row_column_header.PNG)

Here we fetched the column names at index 0 since the first row are the table headers. Secondly, we fetched the rows at index 1; we skipped the first row since those were the table headers. We printed out the column header and the first row to confirm that we successfully scraped the data.

# Create DataFrame from the scraped data
Now we can combine column headers and quarterback stats into a pandas DataFrame.

![pandas](https://github.com/aclao89/NFL_Stats/blob/main/Images/nfl_df.PNG)


# Cleaning & Manipulating Data

## Repetitive Column Names

There are two columns named "Yds". One is for passing yards and other is for yards sacked (yards lost). We need to rename them to differentiate.

![repetitive](https://github.com/aclao89/NFL_Stats/blob/main/Images/cleaning_data.PNG)

## Columns for Passer Rating

The NFL determines [passer rating](https://www.sportscasting.com/what-is-an-nfl-passer-rating-and-how-is-it-calculated/) by four metrics: completion rate (%), yards per passing attempt, touchdowns, and interceptions. Thus, we will select these as our categories for radar charts. I added total yards as well to reflect the cumulative yards throughout the season and description columns for readability.   

![passer_rating](https://github.com/aclao89/NFL_Stats/blob/main/Images/passer_rating.PNG)

## Converting columns to appropriate data types for analysis

We must convert the appropriate data into numerical data since we are unable to manipulate objects. We can use a simply for loop and a Pandas function, to_numeric(), to convert the objects to floats.

![data_type](https://github.com/aclao89/NFL_Stats/blob/main/Images/data_type.PNG)

## Removing extra characters

Pro football reference had put characters next to players names with the following achievements: "* Selected to Pro Bowl, + First-Team All-Pro". Here we used the str.replace() to remove both * and + from the player names.

![replace](https://github.com/aclao89/NFL_Stats/blob/main/Images/data_cleaned_replace.PNG)

## Filter out quarterbacks by average yards thrown

To condense our data, I chose to filter our data down to only the quarterbacks who threw more than 1200 yards.

![avg_yards](https://github.com/aclao89/NFL_Stats/blob/main/Images/filter_yards.PNG)

## Rank function to determine statistical percentile

Here we want to calculate each quarterback's statistical rank by percentile. Luckily, Pandas has a rank() function that can easily perform these calculations. Lastly, we want to inverse our interceptions rank since more interceptions negatively affect passer rating.

![percentile](https://github.com/aclao89/NFL_Stats/blob/main/Images/percent_rank.PNG)

## Final DataFrame for visualization

Here is the final dataframe:

![final_df](https://github.com/aclao89/NFL_Stats/blob/main/Images/final_df.PNG)

Now, we are ready to begin our visualizations!

# Data Visualizations

## Dynamic rc settings

First, we dynamically change the default runtime configuration [(rc)](https://matplotlib.org/stable/api/matplotlib_configuration_api.html#matplotlib.rcParams) settings. Here we modified general plot parameters: font type, font size, axes and tick labels. Since we are generating radar charts, the x-ticks represent the angles around the circle. The xtick.major.pad adds some breathing room between the tick labels and the axis.

![rc_params](https://github.com/aclao89/NFL_Stats/blob/main/Images/rc_params.PNG)

## Hex Codes for NFL Team colors

To get the most accurate NFL team colors, we used this [website](https://teamcolorcodes.com/nfl-team-color-codes/). We grabbed the HEX code for the prominent color of each team and inputted into a dictionary.

![hex_codes](https://github.com/aclao89/NFL_Stats/blob/main/Images/hex_codes.PNG)

## Angles for Radar chart

Since we have 6 categories to plot on a radar chart, so we will need to plot every 60 degrees (360 for a full circle). Using Numpy.linspace(), we  generate our points every 60 degrees.

The setup adjusts where the labels will appear on the circle (instead at 0 degrees, it now appears at 30 degrees).

![setup](https://github.com/aclao89/NFL_Stats/blob/main/Images/setup_chart.PNG)

When we plot the data, we need to duplicate the first category so the shape doesn't remain open. The first and last angles correspond to the same point on the circle. Since our categories are the last six columns of the final dataframe, len(angles) - 1 represents the first of these categories. Then we append the value of the first category onto the end of this array to close the shape.

![plotdata_fill](https://github.com/aclao89/NFL_Stats/blob/main/Images/plotdata_fill.PNG)

Now we can set the labels for the categories (since we have one less category than angles, we omit the last element).

![setlabels](https://github.com/aclao89/NFL_Stats/blob/main/Images/set_labels.PNG)

Lastly, we will add the player name on top of each radar chart. We placed the text at (pi/2, 1.7), in absolute plot coordinates so it appears above the axis.

![playername](https://github.com/aclao89/NFL_Stats/blob/main/Images/playername.PNG)


We created a function to return an Numpy array for player data when an team name is passed.

![qbdata](https://github.com/aclao89/NFL_Stats/blob/main/Images/qb_function.PNG)

# Radar Charts

## NFC West: Arizona Cardinals, San Francisco Niners, Seattle Seahawks, and Los Angeles Rams

![nfc_west](https://github.com/aclao89/NFL_Stats/blob/main/Images/nfc_west.jpg)

1. Russell Wilson, who is in his 10th year, is still performing at an elite level. He has reached at least 75% in all statistical categories. Wilson is also known for his mobile ability which is not reflected in this particular analysis.

2. Kyler Murray is in his second year and shows some promises of a competent quarterback but definitely room for improvement to be considered an elite level.

3. Jared Goff is in his sixth year but stats show very similar to sophomore Kyler Murray. He has less touchdowns and lower passer rating than Murray.

4. Nick Mullen was signed on as starting quarterback after Jimmy Garoppolo suffered an season-ending injury. He has bounced around several teams and practice squads due to his inconsistency and poor decision-making.

## Most Valuable Player Race + Curious Case of Deshawn Watson

According to NFL's top [QB candidates](https://www.nfl.com/news/top-10-nfl-mvp-candidates-in-2020-aaron-rodgers-edges-patrick-mahomes) for MVP, Rodger(GNB), Mahomes(KAN), and Allen(BUF) were the 3 closest in running for the 2020-2021 season.

![mvp_race](https://github.com/aclao89/NFL_Stats/blob/main/Images/mvp_race.jpg)

1. Aaron Rodgers was ultimately named the NFL MVP in 2020. He posted the best passer rating in the NFL at 121.5, a touchdown to interception ratio of 48:5, and highest completion rate at 70.7%. The Packers finished with a 13-3 record and top of their division. Many critics believe his stellar performance as a response to Green Bay Packer's decision to draft a quarterback in the NFL 2020 draft after Rodger's mediocre performance in 2019.

![pass_rate_df](https://github.com/aclao89/NFL_Stats/blob/main/Images/pass_rate_df.PNG)

2. Patrick Mahomes, the reigning Super Bowl MVP, was in close contention with Rodgers. The Chiefs finished the season with the best record at 14-2.  However, if we look closely at the statistics, Rodgers clearly edged out Mahomes in rating, touchdowns, and completion rate.

3. Josh Allen ranked 4th overall in both passer rating and completion rate, 5th in touchdowns and passing yards. The Bills finished with 13-3 and top of their division. There is still room for improvement as he threw 10 interceptions in his early career as a sophomore.

4. I was curious as to why Deshaun Watson was not included in the MVP conversations. Watson, as an individual case, clearly has the stats to warrant consideration. Below are his stats for the 2020 - 2021 season.

1st - Passing yards
<br>
1st - Y/A
<br>
2nd - Overall Rating
<br>
3rd - Completion rate (Cmp %)
<br>
7th - Touchdowns
<br>
27th - Interceptions

Based on those numbers, Watson should be in the conversation, but football is the ultimate team game. While Watson is certainly one of the most valuable players to any franchise in the NFL, his team's abysmal performance of 4-12 ultimately discounted any support for MVP candidacy.

## Quarterbacks of the 2020 NFL Draft

There were four quarterbacks [drafted](https://www.pro-football-reference.com/years/2020/draft.htm) in the 1st round.

-Joe Burrow by Bengals (1st Pick)
<br>
-Tua Tagovailoa by Dolphins (5th pick)
<br>
-Justin Herbert by Chargers (6th pick)
<br>
-Jordan Love by Packers (26th pick) 

## NFC East: Dallas Cowboys, New York Giants, Washington Football Team, and Philadelphia Eagles

![nfc_east](https://github.com/aclao89/NFL_Stats/blob/main/Images/nfc_east.jpg)
