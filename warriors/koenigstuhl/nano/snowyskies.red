;redcode-nano
;name snowy skies
;author John Metcalf
;strategy scanner/imp
;assert CORESIZE==80

     step  equ 5
     first equ ptr+10

     add   #step, ptr
ptr: jmz.f -1,    first
     mov.i #1,    @ptr
     spl   ptr,   >ptr
     mov.i #1,    1
     end   ptr
