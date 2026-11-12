;name Mice
;author Chip Wendell
;strategy Replicator
;strategy Winner of the first ICWS Tournament (1986)
;assert CORESIZE==8192

ptr:  DAT #12
prg:  MOV #12,     ptr
loop: MOV @ptr,    <copy
      DJN loop,    ptr
      SPL @copy
      ADD #653,    copy
      JMZ prg,     ptr
copy: DAT #833
      END loop

