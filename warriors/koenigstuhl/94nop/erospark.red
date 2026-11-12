;redcode-94
;name Erospark
;author F.Z.
;strategy F-Scan
;assert CORESIZE==8000

    ORG    S

HD:
G    dat    #0        ,#0
D    dat    #-200        ,#S+1
C    spl    #1        ,{-5
    mov    D        ,>G
J    djn    C+1        ,>G
S    add    #511        ,SD
    jmz.F    S        ,@SD
B    jmz    C        ,SD
    jmz    C        ,#100
    slt.B    SD        ,#-SD+HD-1
    jmp    S        ,0
    mov    C        ,>2
    spl    S        ,<B+1
SD    mov    S+1        ,1

