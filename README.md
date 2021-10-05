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

![scrape data]()

The two functions via BeautifulSoup used to scrape the data were [findAll()](https://www.crummy.com/software/BeautifulSoup/bs4/doc/#find-all) and [getText()](https://www.crummy.com/software/BeautifulSoup/bs4/doc/#get-text), which return values based on the HTML of the page.
