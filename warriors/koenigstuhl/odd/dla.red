;redcode-94
;name D-cLeAr
;author Christian Schmidt
;strategy Entry #2 for the Random Rage Round 
;assert 1

aGate   equ    (d-6)

        dat    0,           0
        dat    0,           0
d       spl    #0,          0
        mov    bw,          >aGate
        djn.f  -1,          >aGate
        dat    0,           0
        dat    0,           0
bw      dat    >1,         2-aGate

        end    d
