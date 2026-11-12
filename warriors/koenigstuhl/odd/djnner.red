;redcode-94x
;name Djnner
;author Will 'Varfar'
;strategy With such a djn-hostile environment,
;strategy who would be djn-resistant?
;assert 1
;       (CORESIZE==800)

        org     train

gate    dat     1,      MINDISTANCE

        for     8
        dat     1,      1
        rof

train   spl     #1,     1
        djn.f   #1,     <gate 
        djn.f   #1,     <gate 
        djn.f   #1,     <gate
        end
