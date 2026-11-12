;redcode-nano
;name rogue[AI]
;author John Metcalf
;strategy clear
;assert CORESIZE==80

        dist   equ 23

        spl    #-36,       >13
        mov    {0,         >-33
clear   mov    <dist,      {-2
        mov    {clear,     <-dist
        djn.f  clear,      < -8

