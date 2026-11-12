;redcode-tiny
;name BiShot Redux
;author Schmidt/Metcalf
;strategy qBomb -> .66c BiShot Scanner
;assert CORESIZE==800

        first  equ 51
        gap    equ 404

bishot  add.f  #clear+2,     @clear+1
scan    sne.i  first,        first+gap
        djn.f  bishot,       {scan
        djn.f  bomb,         scan

        for    3
        dat    0,0
        rof

        dat    cend-scan+4,  230
bomb    spl    #cend-scan+3, -200
clear   mov    bomb,         }scan
        mov    bomb,         >scan
cend    djn.a  clear,        <bomb

        for    5
        dat    0,0
        rof

qbomb   mov    <first+gap-93,first+gap-72
        mov    <first+gap-52,first+gap-32
        djn.f  scan,         <first+gap-11

        end    qbomb

