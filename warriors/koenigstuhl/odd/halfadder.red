;redcode-94x
;name halfadder
;author Hurkyl
;strategy IRCT10
;assert 1

org start

gate equ start - 1


start   spl 0, <gate
        add.f <-2, <-7
        add.f step, -1
        djn.f -2, <gate
step    dat -80, -80

