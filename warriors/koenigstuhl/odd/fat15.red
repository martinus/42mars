;redcode
;name FAT15
;author Philip Thorne
;assert 1

STEP    EQU     3350
GAP     EQU     25

incr    dat.x   STEP+1,     STEP
        add.f   incr,       scan
scan:   sne.i   STEP-4,     STEP+GAP-4
        jmz.f   scan-1,     {scan
        seq.i   trail,      *scan
        jmp     scan
        add.a   #2720,      scan
        mov.i   trail,      }scan
        jmp     -1
trail:  dat     -1,         -1

    end scan
