;redcode-icws
;name Evil Spirit
;author John Metcalf
;strategy paper/imp
;assert CORESIZE == 8192

        istep equ 3511
        pstepa equ 6671
        pstepb equ 672
        size equ 8

        spl 1,             <4000
        spl 1,             <2000
        spl 1,             <6000

        mov <size,         <papa
papa    spl @0,            pstepa
        mov <size,         <papb
papb    spl @0,            pstepb
        spl 0
        add #istep,        launch
launch  jmp @0,            imp-istep*size
imp     mov 0,             istep

        end

