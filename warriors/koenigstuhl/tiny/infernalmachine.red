;redcode-tiny
;name Infernal Machine
;author John Metcalf
;strategy bomber
;assert CORESIZE==800

        time   equ 194
        hit    equ 5
        step   equ 279

tntbomb mov    step,       1

infern  mov    tntbomb,    @ptr
ptr     mov    tntbomb,    *infern+hit-time*step
gate    add    #step*2,    ptr
        djn    infern,     #time/2
        spl    #0,         0
clear   mov    dbmb,       }gate
        djn.f  clear,      }gate

dbmb    dat    7,          1

        end    infern

