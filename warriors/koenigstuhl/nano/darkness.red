;redcode-nano
;name the darkness within
;author John Metcalf
;strategy paper
;assert CORESIZE==80

        step   equ 64

        mov    >11,      23

paper   spl    #0,       <step
        mov    }paper,   >paper
        mov    >10,      <45
        djn.f  *step-2,  <32

        end
