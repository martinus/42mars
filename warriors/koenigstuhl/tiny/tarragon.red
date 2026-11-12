;redcode-tiny
;name Tarragon
;author John Metcalf
;strategy paper
;assert CORESIZE==800

        dpos   equ decoy+556
        dgap   equ 195
        dst    equ 775

decoy a for    11
        mov    {dpos+dgap+dst*a,dpos+dst*a
        rof

        factor equ 105
        stepa equ 1-3*factor
        stepb equ factor

        spl    2,        {100
        spl    1,        {200
        spl    1,        {300

papera  spl    @0,       {stepa
        mov    }papera,  >papera
paperb  spl    @0,       {stepb
        mov    }paperb,  >paperb
clear   mov    >papera,  {0
        djn.f  clear-1,  <-49

        end

