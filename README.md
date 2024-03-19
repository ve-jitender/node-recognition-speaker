# Speaker Recognition Using Microsoft API Using Node

All functions are present in index.js files.

### 1. Create and Enroll a user
    ```
    createAndEnroll(TrainAudioPath,function(res,err){
        console.log(res);
    });

    res contains id of user.
    ```

### 2. check If user is properly Enrolled
    ```
    checkIfEnroll(UserId, function(res,err){
        console.log(res);
    });

    res contains json with a parameter named EnrollmentStatus
    Only go forward if EnrollmentStatus == 'Enrolled'
    else wait for EnrollmentStatus to be enrolled
    ```

### 3. Submit a voice Identify operation
    ```
    Operation(UserIdsCommaSeparated,testAudioPath, function(res,err){
        console.log(res);
    });

    res contains operation id.
    ```

### 4. Identify the user
    ```
    Identify(operationID, function(res,err){
        console.log(res);
    });

    res contains user Id.
    ```