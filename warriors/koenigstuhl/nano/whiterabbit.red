;redcode-nano
;name White Rabbit
;author John Metcalf
;strategy imp rings
;assert CORESIZE==80

        istep  equ 27

        spl    #imp+istep*2, >43
        mov.i  #-14,         {-1
        spl    imp-istep,    >13
        spl    imp+istep,    <62
imp     mov.i  #63,          istep

        end
