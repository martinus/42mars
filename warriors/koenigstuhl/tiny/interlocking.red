;redcode-tiny
;name interlocking
;author John Metcalf
;assert CORESIZE==800

     st equ 24
     fi equ (ptr+6*st+4)

scan:add   inc,    ptr
ptr: sne.x {fi+st, fi
     add.x inc,    ptr
     jmz.f scan,   @ptr

     add.x ptr,    dest
     mov   clr+4,  {dest
     mov   clr+3,  {dest
     mov   clr+2,  {dest
     mov   clr+1,  {dest
     mov   clr+0,  {dest
dest:spl   ptr-20, >ptr
     mov.x #9,     {dest
     mov.x #10,    {dest

     dat   0,      0

     gate equ (clr-2)

clr: spl   #350,   11
loop:mov   @bptr,  >gate
     mov   @bptr,  >gate
     mov   @bptr,  >gate
bptr:djn.f loop,   {clr

inc: dat   2*st,   st

     end   ptr

