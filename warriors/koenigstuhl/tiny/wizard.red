;redcode-tiny
;name Wizard
;author John Metcalf
;strategy paper
;assert CORESIZE==800

        dpos   equ decoy+556
        dgap   equ 195
        dst    equ 775

decoy a for    9
        mov    {dpos+dgap+dst*a,dpos+dst*a
        rof

        factor equ 96
        stepa  equ factor
        stepb  equ -3*factor

        spl    2,        {100
        spl    2,        {200
        spl    1,        {300

papera  spl    @0,       {stepa
        mov    }papera,  >papera
        mov    }papera,  >papera
paperb  spl    @0,       {stepb
        mov    }paperb,  >paperb
clear   mov    >-43,     {0
        mov    >papera,  {0
        djn.f  clear-1,  <-17

        end

