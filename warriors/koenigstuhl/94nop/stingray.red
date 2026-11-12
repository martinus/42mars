;redcode-94nop
;name Stingray
;author John Metcalf
;strategy oneshot -> boot -> clear
;assert CORESIZE==8000

     st equ 3656
     fi equ (ptr+3+st)

scan:add   inc,    ptr
ptr: sne.x fi+st,  fi
     add.x inc,    ptr
     jmz.f scan,   @ptr

     add.x ptr,    dest
     mov   clr+3,  {dest
     mov   clr+2,  {dest
     mov   clr+1,  {dest
     mov   clr+0,  {dest
dest:spl   ptr-200,{ptr
     mov   clr-1,  {dest
     mov.x #115,   {dest

     dat   0,      0

     gate equ (clr-2)
bptr:dat   1,      8
clr: spl   #3900,  10
loop:mov   *bptr,  >gate
     mov   *bptr,  >gate
     djn.f loop,   }clr

inc: dat   2*st,   st

     end   ptr

 
