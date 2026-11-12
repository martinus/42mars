;redcode-nano
;name the last of the dragons
;author John Metcalf
;strategy another nano Q^4 qscan
;assert CORESIZE==80

; king of the nano hill April 2005

     x equ 59
     y equ 9

     sne   ptr+x*y+y+4, ptr+x*y+y+9
     seq   {ptr,        ptr+x-5
ptr  mul.x #x+1,        #y

loop mov   <35,         >ptr
     djn.f loop,        }loop

     end

