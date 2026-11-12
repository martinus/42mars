;redcode-nano
;name torment
;author John Metcalf
;strategy stone/imp
;assert CORESIZE==80

     step  equ 5
     first equ ptr+32

ptr  spl   #first,   >-26
loop mov   <-12,     }ptr
     spl   loop,     <-19
     add.f #step,    ptr
     mov.i #1,       1
     end
