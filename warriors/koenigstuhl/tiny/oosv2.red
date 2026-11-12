;redcode-tiny
;name Origin of Storms v2
;author John Metcalf
;strategy v2 scanner
;assert CORESIZE==800

; entered the KOTH.org 94nop hill in 11th place on 10th May 2014

scan    sne    42,      344    ; scissors / scanner
        add    inc,     scan   ; - sparse attack on empty memory
        mov    bomb,    }scan  ; - dense attack on occupied memory
        mov    bomb,    >scan
        djn    scan,    #38

bomb    spl    #1,      1
clear   mov    inc,     >scan  ; clear / wipe memory
        djn.f  clear,   >scan
inc     dat    12,      12

        for    4
        dat    0,0
        rof

        s equ  24
        d equ  scan+174

decoy z for    6
        mov    <d+s*z,  {d+s*z+s-1
        rof
        djn.f  scan,    <d+s*8

        end    decoy