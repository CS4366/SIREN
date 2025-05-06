<div align="center">

<picture>
        <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/jaxcksn/jaxcksn/main/files/ttu_cs_dark.png">
        <img alt="Texas Tech Computer Science - Whitacre College of Engineering" src="https://raw.githubusercontent.com/jaxcksn/jaxcksn/main/files/ttu_cs_light.png" width="40%" align="center">
</picture>

# CS4366 Team 10: Group Webpage

</div>

### Group Members:

<div align="center">
  
| <img src="https://github.com/zoiebonnette03.png" width="100" height="100">| <img src="https://github.com/JacobBruen.png" width="100" height="100"> | <img src="https://github.com/jaxcksn.png" width="100" height="100">| <img src="https://github.com/patrickpfontaine.png" width="100" height="100">| <img src="https://github.com/bgorman65.png" width="100" height="100"> |
|:-------------:|---------------|--------------|------------------|:-----------:|
| [Zoie Bonnette](https://github.com/zoiebonnette03) | [Jacob Bruen](https://github.com/JacobBruen) | [Jackson Casey](https://github.com/jaxcksn) | [Patrick Fontaine](https://github.com/patrickpfontaine) | [Barry Gorman](https://github.com/bgorman65) |

</div>

#### Group Roles:

We made the decision not to assign "roles" and everyone is expected to contribute equally to the groups success and be a leader when needed.

---

### Group Meetings & Schedule:

We have decided to meet irregularly, and communicate via group message on an as-needed basis. We use an agile-like format and will use Jira to schedule and communicate tasks.

#### Upcoming Meetings:

Our next meeting with be on April 10th, where we will:

- Discuss outcomes and problems from the first sprint
- Discuss and plan second sprint

#### Past Meetings:

##### Jan 30th, 2025
Our initial meeting was on Jan 30th, in which we planned and discussed the project. After this meeting the following was accomplished:

- Created and scaffolded our Github Repo and Organization.
- Created the base for our powerpoint presentation.
- Created the base for our our IEEE proposal document.
- Setup and joined Jira.

##### Feb 18th, 2025

Our pre-presentation meeting was on Feb 18th, in which we went through our presentation and make sure all the deliverables for Stage 1 are ready.

- Refined our presentation.
- Determined who would read which part of the application.
- Talked a bit about the overall architecture.

##### March 11th, 2025

Our initial stage 2 meeting was on March 11th, we discussed system design decisions and started to mock up the UI of the Frontend.

- Discussed Tracking Service architecture and language
- Created MongoDB schema for the alerts
- We all proposed potential UI designs, and discussed the how our final UI design
- Discussed the report and presentation

##### March 26th, 2025

Our pre-presentation stage 2 meeting was on March 26th, in which we finished up the presentation/report and discussed roles moving forward.

- Revised and finished the presentation
- Revised the report and discussed potential points to mention in it
- Discussed microservice implementation, especially the Frontend
- Gave roles for implementation and organized first 2-week sprint

##### April 9th, 2025

Our post sprint one meeting was on April 9th, in which we discussed the outcomes and goals of the next sprint.

- Finished scaffolding of Frontend Service
- Finished NOAA Service
- Developed operational version of the other services
- Discussed addition of GEO Service
- Gave roles for implementation and organized second 2-week sprint

##### April 22nd, 2025

Our post sprint two meeting was on April 22nd, in which we discussed the outcomes of sprint two and made our presentations.

- Finished functionality of Frontend Service
- Finished Push Service, Tracking Service, API Service and GEO Service
- Made presentation slides for EAB Dinner and in class presentation
- Discussed the final report, and gave roles to complete it.
---
### Validation Results

Since our project focused on creating an endpoint for public and organizational access to real-time weather alerts, most of our validation was performed manually across various services to ensure functionality and performance. We would have liked to implement unit testing to ensure every service is working as intended, but we did not have enough time and thus relied on manual testing in order to validate our services were working as intended. Here is a brief breakdown of the testing we were able to perform in order to validate our system and the results:

#### Frontend Validation

- Tested React components with edge cases to verify proper error handling and UI responses.
- Lightly load-tested the frontend during a high-alert weather day (via the NWS Lubbock office) to assess performance under increased alert volume.

#### GeoJSON Validation

- Confirmed that weather alert polygons were rendered correctly on the frontend map.
- Observed no performance degradation during rendering, indicating the service performs efficiently.

#### Push Validation

- Verified successful display of push notifications on the frontend.
- Informally benchmarked alert dissemination speed and found it outperformed several major weather apps, including the Weather Service app, The Weather Channel, AccuWeather, and the iOS Weather App.

#### API Validation

- Although we did not implement automated unit testing, we manually verified all core API functionalities.
- Ensured that CRUD operations functioned correctly, as alerts could be received and historical alerts could be viewed via the frontend.

#### Tracking Validation

- Confirmed that a proper tracking ID's were added to alerts by viewing MongoDB, using the tool Compass.
- Confirmed that alerts were correctly updated and deleted the same way.

#### NOAA Validation

- Verified that alerts were successfully received in CAP JSON format via the messaging queue, confirming proper integration with NOAA feeds.

#### Results
While we weren't able to implement unit tests, manual testing showed that our application is working as we intended it to. There are additional features we want to add, but the core functionality of SIREN is there and works as intended, allowing users to view weather alerts on an efficient and optimal platform. 
