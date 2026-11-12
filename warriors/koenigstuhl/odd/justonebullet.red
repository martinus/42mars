;redcode-94
;name Just One Bullet
;author Christian Schmidt
;strategy .66c BiShot Scanner
;assert CORESIZE==8000

s       add.f   #P,          P          ;10 chars
        sne     *P,          @P         ; 8 chars
        djn.f   s,           @P         ; 9 chars
        djn.f   B,           P          ; 8 chars

    for 13                              ; 5 chars
        dat     0,           0          ; 6 chars
    rof                                 ; 3 chars

P       dat     3545,        7568       ;13 chars
        dat     11,          4091       ;10 chars
B       spl     #9,          7851       ;11 chars
L       mov     B,           }P         ; 8 chars
        mov     B,           >P         ; 7 chars
        djn.a   L,           <B         ; 9 chars
                                     ;->107 chars

