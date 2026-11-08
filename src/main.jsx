import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { initialCourse } from "./initialCourse.js";
import "./styles.css";
createRoot(document.getElementById("root")).render(<App course={initialCourse} />);
