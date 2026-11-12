;redcode-nano
;name ghost::sys
;author John Metcalf
;strategy paper/imp
;assert CORESIZE==80

        pstep  equ -21

paper   spl    #0,       >17
        mov    }paper,   }dest
dest    spl    <pstep,   <52
        mov.i  #68,      }1
        djn.f  27,       {62

