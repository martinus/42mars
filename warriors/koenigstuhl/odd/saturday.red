;redcode
;name Saturday Afternoon Soldiers
;author Steve Gunnell
;strategy I give up. None of my core clears worked. sheesh ...
;assert 1
; KOFACOTO 4

ptr    dat.f  100      ,0
bptr   jmp    0        ,0
start  add.a  #100    ,ptr
       jmz.f  -1       ,*ptr
       sub.a  #10      ,ptr
       jmn.f  -1       ,*ptr
       add.a  #10      ,ptr
       jmn.f  #0       ,{ptr
       mov.ab ptr      ,bptr
       sne.i  check1   ,@bptr
       jmp    base
       sne.i  check2   ,@bptr
       jmp    base1
       jmp    start

base   add.ab #2520    ,bptr
base1  add.ab #5       ,bptr
       jmp    @bptr

check1 dat.f  0        , -16
check2 spl.b  #0       ,<-50
fill   jmp    -1       ,1

       end    start 
