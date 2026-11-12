;redcode-icws
;name Catch the Heffalump!
;author John Metcalf
;strategy spiral for the 11th IRC tournament
;       CORESIZE==8192
;assert 1

     istep equ 3277
     spl   1
     spl   1
     spl   1
     spl   1
     spl   1
     spl   2
ptr: jmp   @0,     imp
     add   #istep, ptr
     dat   #0,     #0
imp: mov   0,      istep
     end
