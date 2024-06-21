function registry_url(network_id){
   return api().url("./meta/registry.json").
                headers({"content-type","application/json"}).
                get().then(function(response){
                                return response[network_id];
                           });
}
function networks(){
    return api().url("./
}
