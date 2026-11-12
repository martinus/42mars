;redcode
;name CountTo10
;author Roy
;strategy Left overs of the not working bit and start n the enemy!
;assert 1
org 2
gate     jmp 0,<-13
         mov gate,-4
         spl -5,>11
         mov 0,1
         jmp 0,<-13
         mov gate,-4
         spl -5,>11
         mov 0,1
         spl -5,>11
         mov 0,1
        