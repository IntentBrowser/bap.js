import { network } from "./network";
import { isCrawler, api, loadLocation, watchLocation } from "./api";


const bap = {
    network,
    loadLocation,
    watchLocation,
    api,
    isCrawler,
};
export default bap;
