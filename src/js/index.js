import { network } from "./network";
import { isCrawler, api, loadLocation, watchLocation, isUserLocationAvailable } from "./api";


const bap = {
    network,
    loadLocation,
    watchLocation,
    api,
    isCrawler,
    isUserLocationAvailable,
};
export default bap;
