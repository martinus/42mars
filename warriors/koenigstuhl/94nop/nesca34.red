;redcode-94nop
;assert 1
;name nesca34
;author lain
;strategy reviving an old favorite, a simple oneshot


steps     equ     24 ;22
hob     equ     7 ;(6-10+5)
clearpre equ ((0-10)-5)


pointer        dat #2,#scan-4
            dat.f #1,>5
dstart        spl #1,5
     mov.i *pointer,>pointer

scndis equ 10
streamstart equ 4860

             djn.f -1,<-18
    for 89
    dat $0,$0
    rof
step         dat #steps,#steps
            add.f step,scan
scan        sne.i $MINDISTANCE+10+hob,$MINDISTANCE+10+hob+scndis
            djn.f -2,{streamstart

            add.ab scan,pointer
            jmp dstart

    end scan

