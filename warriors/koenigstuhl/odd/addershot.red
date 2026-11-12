;redcode-94x
;name AdderOnshot
;author Roy van Rijn
;strategy IRCT10
;       CORESIZE==800
;assert 1
ptr1 dat 10,10
    add.f ptr1,ptr2
ptr2 sne.f 50,400
    djn.f -2,}ptr2
loo spl 0,0
    add.f ptr2,}ptr2
    add.f ptr2,>ptr2
    djn.f loo,>ptr2
end ptr2
