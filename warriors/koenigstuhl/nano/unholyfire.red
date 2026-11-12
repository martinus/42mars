;redcode-nano
;name Unholy Fire
;author John Metcalf
;strategy paper/clear
;assert CORESIZE==80

        pstep  equ -23

paper   spl    #0,       >34
        mov    }paper,   }dest
dest    spl    <pstep,   >-6
clr     mov    *-5,      <dest
        djn.f  clr,      <-32

        end

