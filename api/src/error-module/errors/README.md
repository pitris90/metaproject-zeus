* Every exception in this folder has to override `code`, `httpMessage` and `httpStatus` for `Swagger` documentation and then send them to constructor for processing in exception filter.
* Every exception in `errors` folder has to have suffix `.api-exception.ts` to be picked up by Swagger CLI Plugin.

## Projects

* 10001 - Project already exists
* 10002 - Project not found
* 10003 - Project is already approved or denied
* 10004 - Project has invalid status for this action
* 10005 - Requested resource is invalid

## Users
* 11000 - Invalid user

## Publications
* 12000 - Publication not found

## Resources
* 13000 - Resource not found
* 13001 - Resource already exists
* 13002 - Resource attribute already belongs to resource
* 13003 - Invalid resource operation