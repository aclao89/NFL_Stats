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

We must convert the appropriate data into numerical data since we are unable to manipulate objects. We can use a simply for loop to iterate the columns into floats to analyze.

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
