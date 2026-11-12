;redcode-nano
;name servant of the implord
;author John Metcalf
;strategy qscan
;assert CORESIZE==80

     x     equ 18
     y     equ 73

     sne   ptr+x*y-2,  ptr+x*y-7
     seq   }adj,       ptr+x*y+y-5
adj: mul   #x,         ptr
ptr: mov   >-19,       y
     djn.f <0,         >0
     end
