<template>
  <div class="app">
    <div v-if="this.description!=null">
      <div class="title"> <b>Category: {{this.description[0].category_name}}</b> </div> <hr>
      {{this.description[0].category_description}} <br>
      <div class="title"> <b>Subcategory: {{this.description[0].subforum_name}}</b> </div> <hr>
      {{this.description[0].subforum_description}} <br>
      <button class="suscribe" v-on:click="unsubscribe()" v-if="suscribed==true && this.$store.state.logged_in==true">Unsuscribe</button>
      <button class="suscribe" v-on:click="subscribe()" v-else>Suscribe</button>
    </div>
  </div>
</template>

<script>
import axios from 'axios';
import { mapState } from 'vuex';
import Swal from 'sweetalert2'

export default {
  name: "Description",

data(){
  return{

     description:null,
     suscribed:false,

  }

},
mounted () {
axios.get('http://localhost:5000/description',{params:{thread_id:this.$store.state.selected_thread.thread_id}})
  .then(response => (this.description = response.data))

axios.get('http://localhost:5000/subscriptions', {
  params: {
    user_id: this.$store.state.user_id,
    subforum_id: this.$store.state.selected_thread.subforum_id
  }
}).then((response) => {
  if(typeof response.data[0] != "undefined")
  {
    this.suscribed=true;
  }})

},


computed: mapState(['logged_in']),

watch: {
    logged_in: function (newVal, oldVal) {
    if (newVal == true)
    {
      axios.get('http://localhost:5000/subscriptions', {
        params: {
          user_id: this.$store.state.user_id,
          subforum_id: this.$store.state.selected_thread.subforum_id
        }
      }).then((response) => {
        if(typeof response.data[0] != "undefined")
        {
          this.suscribed=true;
        }})
    }
}},

methods: {

  subscribe()
  {
    if (this.$store.state.logged_in==true)
    {
      console.log(this.$store.state.username, this.$store.state.selected_thread.subforum_id)
     // console.log(this.$store.state.username, this.$store.state.user_id,   this.$store.state.selected_thread.subforum_id, this.description[0].subforum_name)

      axios.get('http://localhost:5000/create_subscription', {
              params: {
                user_id: this.$store.state.user_id,
                subforum_id: this.$store.state.selected_thread.subforum_id
              }
            }).then(response => {
              this.suscribed=true;
              Swal.fire({
                          type: 'success',
                          title: "Subscription Successful",
                          focusConfirm: false,
                          showConfirmButton: false,
                          timer: 1200
                        });
            })
    }
    else
    {
      Swal.fire({
                  type: 'error',
                  title: "Oops..",
                  text: 'You must first log in to subscribe',
                  focusConfirm: false,
                  timer: 1500
                });

    }

  },
  unsubscribe()
  {
    axios.get('http://localhost:5000/delete_subscription', {
      params: {
        user_id: this.$store.state.user_id,
        subforum_id: this.$store.state.selected_thread.subforum_id
      }
    }).then(response => {
       this.suscribed=false;
       Swal.fire({
                   type: 'success',
                   title: "Unsubscription Successful",
                   focusConfirm: false,
                   showConfirmButton: false,
                   timer: 1200
                 });
    })
  }
}
}



</script>


<style scoped>

.title{
  margin-top: 30px;
}

.suscribe{
  border-radius: 5px;
  display: inline-block;
  color: white;
  cursor: pointer;
  border: none;
  text-overflow: ellipsis;
  text-align: center;
  text-decoration: none;
  display: inline-block;
  background-color:#3676e8;
  transition: all 0.5s;
  margin-top: 30px;
  font-size: 17px;
  padding: 10px;
  padding-left: 15px;
  padding-right: 15px;
  margin-left: 37%;
}

.suscribe:hover {
  background-color:  #6496EE;
}

.app{
  display: inline-block;
  font-family: 'Avenir', Helvetica, Arial, sans-serif;
  float: right;
  width: 28%;
  padding-bottom:3%;
  text-overflow: ellipsis;
  padding-left: 30px;
  padding-top: 0%;
  margin-top: -10px;
  position: fixed;
  right: 0px;
}


hr {
    display: block;
    height: 1px;
    border: 0;
    border-top: 1px solid #ccc;
    margin-top: 10px;
    margin-bottom: 10px;
    padding: 0;
}

</style>
