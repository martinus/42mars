;redcode-tiny
;name Stingray
;author John Metcalf
;strategy oneshot -> boot -> clear
;assert CORESIZE==800

; Based on Interlocking, new step and G2-style clear
; Entered the SAL tiny hill in 2nd place on 1st May 2019

     st equ 304
     fi equ (ptr+5+st)

scan:add   inc,    ptr
ptr: sne.x fi+st,  fi
     add.x inc,    ptr
     jmz.f scan,   @ptr

     add.x ptr,    dest
     mov   clr+3,  {dest
     mov   clr+2,  {dest
     mov   clr+1,  {dest
     mov   clr+0,  {dest
dest:spl   ptr-19, {ptr
     mov   clr-1,  {dest
     mov.x #10,    {dest

     dat   0,      0

     gate  equ (clr-2)

bptr:dat   1,      8

clr: spl   #550,   10
loop:mov   *bptr,  >gate
     mov   *bptr,  >gate
     djn.f loop,   }clr

inc: dat   2*st,   st

     end   ptr

