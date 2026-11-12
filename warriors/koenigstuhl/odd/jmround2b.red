;redcode-?
;name Weasel
;author John Metcalf
;strategy clear
;       CORESIZE==160
;assert 1

        mov    <80,      120

wipe    spl    #10,      <wipe-5
clear   mov    dbmb,     }wipe
        mov    >wipe+50, <wipe-5
        djn.f  clear,    }wipe

dbmb    dat    5,        0

        end

