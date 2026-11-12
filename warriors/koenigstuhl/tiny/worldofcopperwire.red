;redcode-tiny
;name world of copper wire
;author John Metcalf
;strategy qbomb -> clear
;strategy clear is a G2 / BiShot hybrid
;assert CORESIZE==800

        org    decoy

gate    dat    40,       267+40

bptr    dat    bomb,     bomb

        dat    10,       390
bomb    spl    #10,      435
clear   mov    *bptr,    }gate
        mov    @bptr,    >gate
        djn.f  clear,    >bomb

        for    4
        dat    0,0
        rof

decoy a for    8
        mov    {decoy-200-a*40,{decoy-220-a*40
        rof
        jmp    clear-1,  <120

        end

