

document.addEventListener("contextmenu", (event) => event.preventDefault()); //bonus: disable right click on the map

// api key to access JotForm
JF.initialize({ apiKey: "8ae1a9cbfe5470129d1af524cc098f4c" });

mapboxgl.accessToken =
"pk.eyJ1Ijoic3Bsb2htYXIiLCJhIjoiY2syaHVxdml5MHpsbzNtbzF1NXE1ZHYxeiJ9.R73K7V9poI3Muj84Wuw_YA";

// limit the search engine boundary extent to the center of Boston
const bostonBounds = [-71.191247, 42.227911, -70.648072, 42.450118];

const map = new mapboxgl.Map({
  container: "map", // Container ID
  style: "mapbox://styles/splohmar/cl9wu1yx3002q15s5ndaa0sms", // Map style to use
  center: [-71.09561, 42.3638], // Starting position [lng, lat]
  zoom: 12, // Starting zoom level
  projection: "globe",
});

// stylize the globe effect
map.on("style.load", () => {
  map.setFog({
    range: [1, 7],
    color: "#d6fffc",
    "horizon-blend": 0.03,
    "high-color": "#000000",
    "space-color": "#000000",
    "star-intensity": 0,
  });
});

// Initialize the geocoder aka the search engine
const geocoder = new MapboxGeocoder({
  accessToken: mapboxgl.accessToken, // Set the access token
  mapboxgl: mapboxgl, // Set the mapbox-gl instance
  placeholder: "Search Boston", //placeholer text for the search bar
  bbox: bostonBounds, //limit search results to Philadelphia bounds
});

// Add the geocoder to the map
map.addControl(geocoder);

// Create a function to access the jotform submissions . Format: (formID, callback)
function getSubmissions() {
  JF.getFormSubmissions("223194308131044", function (responses) {
    // array to store all the submissions: we will use this to create the map
    console.log(responses)
    const submissions = [];
    // for each responses
    for (var i = 0; i < responses.length; i++) {
      // create an object to store the submissions and structure as a json
      const submissionProps = {};

      submissionProps["type"] = "Feature";
      submissionProps["geometry"] = {
        type: "Point",
      };
      submissionProps["properties"] = {};

      // add all fields of responses.answers to our object
      const keys = Object.keys(responses[i].answers);
      keys.forEach((answer) => {
        let currentAnswer = responses[i].answers[answer].answer;
        if (!currentAnswer) {
          // delete the key if the answer is empty
          delete responses[i].answers[answer];
          return;
        }
        const lookup = "name";
        const entry = responses[i].answers[answer].name;

        if (entry === "latitude" || entry === "longitude") {
          currentAnswer = parseFloat(currentAnswer);
        }

        submissionProps.properties[responses[i].answers[answer][lookup]] =
          currentAnswer;
      });

      submissionProps.geometry["coordinates"] = [
        submissionProps.properties.longitude,
        submissionProps.properties.latitude,
      ];

      // add submission to submissions array
      submissions.push(submissionProps);

     
    }


    // see if the source exists
    if (map.getSource("submissions")) {
      // update the source
      map.getSource("submissions").setData({
        type: "FeatureCollection",
        features: submissions,
      });
    }

    // add source after map load
    map.on("load", () => {
      map.addSource("submissions", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: submissions,
        },
      });

      map.addLayer({
        id: "submissions",
        type: "circle",
        source: "submissions",
        paint: {
          "circle-radius": 10,
          "circle-color": "#9198e5",
          "circle-stroke-width": 1,
          "circle-stroke-color": "#000000",
        },
      });
    });
  });
}

// immediately call the function to get the submissions
getSubmissions();

// create a popup for the basemap
const basemapPopup = new mapboxgl.Popup({
  closeButton: false,
  closeOnClick: false,
});

// create a popup on hover
const hoverPopup = new mapboxgl.Popup({
  closeButton: false,
  closeOnClick: false,
});

// create a popup on click
const popup = new mapboxgl.Popup({
  closeButton: true,
  closeOnClick: true,
});

// create a function to capitalize the first letter of a string array
function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

// create a map.on mouse enter event for "road-simple" and "building" layers
map.on("mousemove", "land-use", (e) => {
  const info = e.features[0].properties.class
    .split("_")
    .map((word) => capitalizeFirstLetter(word))
    .join(" ");
  map.getCanvas().style.cursor = "pointer";

  basemapPopup.setLngLat(e.lngLat).setHTML(`${info}`).addTo(map);
});

map.on("mouseleave", "land-use", () => {
  map.getCanvas().style.cursor = "";
  basemapPopup.remove();
});

// add a hover event that shows a hoverPopup with the description
map.on("mouseenter", "submissions", (e) => {
  // Change the cursor style as a UI indicator.
  map.getCanvas().style.cursor = "pointer";

  const coordinates = e.features[0].geometry.coordinates.slice();

  // create some HTML objects to render in the popup
  const htmlContainer = document.createElement("div");
  const title = document.createElement("h3");
  title.textContent = e.features[0].properties.placeName;
  const description = document.createElement("p");
  description.innerHTML = e.features[0].properties.description;

  // append the HTML objects to the container
  htmlContainer.appendChild(title);
  htmlContainer.appendChild(description);

  // Ensure that if the map is zoomed out such that multiple
  // copies of the feature are visible, the hoverPopup appears
  // over the copy being pointed to.
  while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
    coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
  }

  // Populate the hoverPopup and set its coordinates
  hoverPopup.setLngLat(coordinates).setHTML(htmlContainer.outerHTML).addTo(map);
});

// hide the hoverPopup when the mouse leaves the layer
map.on("mouseleave", "submissions", () => {
  // set the cursor back to default
  map.getCanvas().style.cursor = "";
  // remove the hoverPopup
  hoverPopup.remove();
});

// create a global timeout that can be used to refresh the data on the map
let timeout;

// on click of the map add a new point to the map
map.on("click", (e) => {
  // createa new geojson object from click
  const newPoint = {
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [e.lngLat.lng, e.lngLat.lat],
    },
    properties: {
      description: "",
    },
  };
  //   add a new point to the map
  if (map.getSource("newPoint")) {
    //if the source already exists, update the source
    map.getSource("newPoint").setData(newPoint);
  } else {
    //if its the first time the user has clicked, add the source and layer
    map.addSource("newPoint", {
      type: "geojson",
      data: newPoint,
    });
    // add a new layer to the map
    map.addLayer({
      id: "newPoint",
      type: "circle",
      source: "newPoint",
      paint: {
        "circle-radius": 10,
        "circle-color": "#f30",
        "circle-stroke-width": 1,
        "circle-stroke-color": "#000000",
      },
    });


  }

  //make callback function on submit to update the new point with the description and then submit to jotform
  const updateDescription = (location) => {
    /**
     * this function will update the description of the new point and then submit the data to jotform.
     * Since it is a function it will only trigger when called upon by the submit button.
     * @param {string} location - the location of the new point
     * @param {string} description - the description of the new point
     * @param {object} submission - the submission object
     */

    // clear the existing timeout if it is about to trigger
    clearTimeout(timeout);

    // get the description from the input
    const description = document.getElementById("description").value;
    newPoint.properties.description = description;
    newPoint.properties.placeName = location;
    // add name and email to newpoint
    newPoint.properties.name = document.getElementById("name").value;
    newPoint.properties.email = document.getElementById("email").value;

    map.getSource("newPoint").setData(newPoint);


    // add a new jotform submission
    const submission = new Object();
    // name
    submission[3] = newPoint.properties.name;
    // email
    submission[4] = newPoint.properties.email;
    // place name
    submission[5] = newPoint.properties.placeName;
    // latitude
    submission[8] = newPoint.geometry.coordinates[1];
    // longitude
    submission[9] = newPoint.geometry.coordinates[0];
    // description
    submission[7] = newPoint.properties.description;

    if (
      // if everything has been filled out
      newPoint.properties.description &&
      newPoint.properties.name &&
      newPoint.properties.email
    ) {
      // submit the data to jotform and remove the popup
      popup.remove();
      JF.createFormSubmission(
        "223194308131044",
        submission,
        function (response) {
          console.log("submission response", response);

          // assign a timeout to the global timeout variable and reload the map after 3 seconds
          timeout = setTimeout(() => {
            getSubmissions();
          }, 3000);
        }
      );
    } else {
      alert("Please fill out all fields");
      // assign a yellow outline to the popup
    }
  };

  async function getLocationName() {
    // reverse geocode the point using fetch
    await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${e.lngLat.lng},${e.lngLat.lat}.json?access_token=${mapboxgl.accessToken}`
    )
      .then((response) => response.json())
      .then((data) => {
        const location = data.features[0].place_name
          .split(",")
          .slice(0, 2)
          .join(",");

        //   add a popup to the new point with a textarea input field
        const htmlContainer = document.createElement("div");
        const title = document.createElement("h3");
        title.textContent = location;

        // create name and email input fields
        const nameInput = document.createElement("input");
        nameInput.setAttribute("type", "text");
        nameInput.setAttribute("id", "name");
        nameInput.setAttribute("placeholder", "name");
        nameInput.addEventListener("input", (e) => {
          newPoint.properties.name = e.target.value;
        });

        const emailInput = document.createElement("input");
        emailInput.setAttribute("type", "email");
        emailInput.setAttribute("id", "email");
        emailInput.setAttribute("placeholder", "email");
        emailInput.addEventListener("input", (e) => {
          newPoint.properties.email = e.target.value;
        });

        // create description input
        const textarea = document.createElement("textarea");
        textarea.id = "description";
        textarea.placeholder = "description";
        textarea.style.resize = "none";

        // create submit button
        const submitButton = document.createElement("button");
        submitButton.id = "submit";
        submitButton.textContent = "Submit";

        // append all the elements to the html container
        htmlContainer.appendChild(title);
        htmlContainer.appendChild(textarea);
        htmlContainer.appendChild(nameInput);
        htmlContainer.appendChild(emailInput);
        htmlContainer.appendChild(submitButton);

        // add the popup to the map
        popup
          .setLngLat([e.lngLat.lng, e.lngLat.lat])
          .setHTML(htmlContainer.outerHTML)
          .addTo(map);

        // get the newly added submit button and call the updateDescription function on click
        const appendedSubmitButton = document.getElementById("submit");
        appendedSubmitButton.addEventListener("click", function () {
          updateDescription(location);
        });
      });
  }
  // call the getLocationName function, which triggers the popup and updateDescription function
  getLocationName();
});

// close the click popup when pressing the escape key
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    popup.remove();
  }
});
