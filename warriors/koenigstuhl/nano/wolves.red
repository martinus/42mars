;redcode-nano
;name the wolves are running
;author John Metcalf
;strategy another nano Q^4 qscan
;assert CORESIZE==80

     x equ 53
     y equ 13

     sne   ptr+x*y+y+4, ptr+x*y+y+9
     seq   {ptr,        ptr+x+5
ptr  mul.x #x+1,        #y

loop mov   <ptr+30,     >ptr
     djn.f loop,        }loop

     end

