import "./styles/main.css";
import { startRouter } from "./app/router";

const app = document.querySelector<HTMLDivElement>("#app")!;
startRouter(app);
