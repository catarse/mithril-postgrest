#mithril.postgrest [![Circle CI](https://circleci.com/gh/catarse/mithril.postgrest/tree/master.svg?style=svg)](https://circleci.com/gh/catarse/mithril.postgrest/tree/master) [![Code Climate](https://codeclimate.com/github/catarse/mithril.postgrest/badges/gpa.svg)](https://codeclimate.com/github/catarse/mithril.postgrest)

## Use cases
What this library is supposed to do:
  
  * Help you authenticating in a [PostgREST](https://github.com/begriffs/postgrest) server.
  * Keep some session information in the browser localStorage.
  * Provide wrappers arround the mithril request function to use JWT.
  
## Usage
First we should init the library so that it will build the functions to access the API.
The init function takes one argument which is the API endpoint prefix, 
containing the URI to which all addresses will be appended. 
If the API is being served from exactly the same location as the page running the JS
you can just initialize without any argument.

To use an API available at ```http://api.foo.com/v1``` you can use the code:
```javascript
m.postgrest.init("http://api.foo.com/v1", {method: "GET", url: "/authentication_endpoint"});
```

This will create three functions:

  * m.postgrest.request - which should be used for anonymous API calls.
  * m.postgrest.requestWithToken - which should be used for authenticated API calls.
  * m.postgrest.model - creates an object that abstracts an API endpoint

Both functions are just proxies for mithril's ```m.request``` and will return in the same fashion.

However, the ```m.postgrest.requestWithToken``` stores the JWT for api authentication in the localStorage key "postgrest.token".

To logout of the API and erase the token from the browser localStorage you should call:

```javascript
m.postgrest.reset();
```

### Models
To generate a model you should call the model function passin the name and an array with its attribute names. The name of the model should be the name of the endpoint in the PostgREST server.

For example, the following code:
```javascript
m.postgrest.model('users', ['name', 'is_admin']);
```

will generate a model that uses the ```/users``` endpoint and has two properties, ```name``` and ```is_admin```.

The model will have the following methods:

 * getPage(pageNumber) - gets a page of data issueing a GET request to the endpoint.

The model will have all the properties defined in it's creation plus:

 * pageSize - defines the size of each page that comes in ```getPage``` call. Default is 10. 