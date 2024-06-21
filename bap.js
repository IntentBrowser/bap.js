function bap(ps_base_url){
   return {
        meta : {
            network_id: "",
        }

        choose_network: function(network_id){
            this.meta.network_id = network_id;
        },

        create_request: function(action_name){
            return {
                context : {
                    action: action_name,
                }
            }
        }
        search : function(request){
            api().url(ps_base_url).parameters(request).headers({"content-type","application/json"}).post().then(function(response){
                
            });






        }
   }
}
