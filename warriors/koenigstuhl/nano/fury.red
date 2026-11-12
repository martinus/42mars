;redcode-nano
;name Fury
;author John Metcalf
;strategy paper/clear
;assert CORESIZE==80

        pstep  equ 52

paper   spl    #0,       >17
        mov    }paper,   }dest
dest    spl    <pstep,   >63
clr     mov    >-14,     -8
        djn.f  <0,       >0

        end
