;redcode-94x
;name Snowstorm
;author John Metcalf
;strategy qscan -> stone/imp
;assert CORESIZE==55440

         org    qscan

         step   equ 51047
         time   equ 9299
         gap    equ 14
         first  equ (-step*time)

         iboot  equ 5209

warr     spl    1,        <500
         spl    1,        <1500
         mov    <isrc,    {idest
         mov    <id2,     {id2
         spl    1,        <2500
         mov    {ssrc,    {sdest
         spl    1,        <3500
sdest    spl    2000,     <4000
         spl    1,        <4500
id2      spl    iboot,    isrc+4
idest    djn.f  iboot+27720,<29000

         istep  equ 32191

isrc     spl    0,        4
         add.f  #istep,   launch
launch   djn.f  imp-istep*32,<1720

imp      mov.i   #istep,  *0

ssrc     spl    #8,       <-2995
         spl    #0,       <ssrc-2995
stone    mov    bomb,     <hit+first
hit      mov    bomb,     @stone
         add    #step,    @hit
         djn.f  stone,    <ssrc-2995

bomb     dat    <27721,   #1-gap

         for    200-52
         dat    0,0
         rof

         qfac   equ 1597
         qdec   equ 24614

         qa     equ ((qfac*(qtab0-1-qptr)+1)%CORESIZE)
         qb     equ ((qfac*(qtab0-qptr)+1)%CORESIZE)
         qc     equ ((qfac*(qtab1-1-qptr)+1)%CORESIZE)
         qd     equ ((qfac*(qtab1-qptr)+1)%CORESIZE)
         qe     equ ((qfac*(qtab1+1-qptr)+1)%CORESIZE)
         qf     equ ((qfac*(qtab2-qptr)+1)%CORESIZE)

         qtime  equ 24
         qstep  equ -7
         qgap   equ 94

qdecode  mul.b  *q1,          qptr
q0       sne    <qtab0,       @qptr
q1       add.b  qtab1,        qptr
q2       mov    qtab2,        @qptr
qptr     mov    qtab2,        *qdec
         add    #qstep,       qptr
         djn    q2,           #qtime
         jmp    warr,         qc
qtab1    dat    4000,         qd
         dat    4000,         qe

qscan    sne    qptr+qdec*qe, qptr+qdec*qe+qe
         seq    <qtab1+1,     qptr+qdec*(qe-1)+qe-1
         jmp    qdecode,      }q1
         sne    qptr+qdec*qb, qptr+qdec*qb+qd
         seq    <qtab0,       qptr+qdec*(qb-1)+qd
         jmp    qdecode,      {qdecode
         sne    qptr+qdec*qa, qptr+qdec*qa+qd
         seq    <qtab0-1,     qptr+qdec*(qa-1)+qd
         djn.a  qdecode,      {qdecode
         sne    qptr+qdec*qf, qptr+qdec*qf+qd
         seq    <qtab2,       qptr+qdec*(qf-1)+qd
         jmp    qdecode,      }qdecode
         sne    qptr+qdec*qc, qptr+qdec*qc+qc
         seq    <qtab1-1,     qptr+qdec*(qc-1)+qc-1
         jmp    qdecode,      {q1
         sne    qptr+qdec*qd, qptr+qdec*qd+qd
         seq    <qtab1,       qptr+qdec*(qd-1)+qd-1
         jmp    qdecode,      <qa
qtab0    jmp    warr,         <qb
qtab2    dat    qgap,         qf

         end

