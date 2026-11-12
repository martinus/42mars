;redcode-94
;name Carbonite
;author Ian Sutton
;assert CORESIZE==8000
org stone
dbomb   dat     >-1, >1
stone   spl     #0, <-100
        mov     dbomb, tar-197*3500
tar     add     #197, -1        ; gets bombed to start coreclear
        djn.f   -2, <-1151
