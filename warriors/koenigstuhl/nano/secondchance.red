;redcode-nano
;name second chance
;author John Metcalf
;strategy two-shot
;assert CORESIZE==80

    step  equ 5
    first equ scan+14

scan:sub   #-step,   #first
    jmz.f scan,     @scan
wipe:mov.i #-4,      >scan
    djn   wipe,     #15
    jmp   scan,     <14
    end   scan+1

