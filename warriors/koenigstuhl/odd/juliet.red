;redcode
;author Myer Bremer
;name juliet
;strategy hoping no one else plays paper :)
;assert 1

        step1 equ 970
        step2 equ 895
        step3 equ 683
        step4 equ 947

        spl 1, {500
        spl 1, {600
        spl 1, {700
p1      spl @0, step1
        mov }p1, >p1
p2      spl @0, step2
        mov }p2, >p2
p3      spl @0, step3
        mov }p3, >p3
        mov {p3, <p4
p4      jmz.a @0, step4
